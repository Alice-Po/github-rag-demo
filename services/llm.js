import { HfInference } from '@huggingface/inference';
// const LLM_MODEL = 'mistralai/Mixtral-8x7B-Instruct-v0.1'; // Modèle français Mistral AI
// const HF_TOKEN = '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';

export class LLMService {
  constructor(model, token) {
    if (!token) {
      throw new Error('Token Hugging Face manquant');
    }
    this.token = token;

    // Debug du token (ne pas laisser en production)
    console.log('Token format:', {
      length: this.token.length,
      startsWith: this.token.substring(0, 3),
      isBearer: this.token.startsWith('Bearer'),
    });

    // Debug du token
    console.log('Token configuration:', {
      exact: this.token, // Affichage du token exact pour debug
      length: this.token.length,
      authorization: `Bearer ${this.token}`,
    });

    this.hf = new HfInference(token);
    this.model = model;
  }

  async generateAnswer(question, context, repoList) {
    console.log('Début de la génération de la réponse...');
    console.log('Modèle utilisé:', this.model);

    try {
      // Création du header d'autorisation
      const authHeader = `Bearer ${this.token}`;
      console.log('Header envoyé:', authHeader);

      // Test exact comme le curl qui fonctionne
      const testResponse = await fetch('https://huggingface.co/api/whoami-v2', {
        method: 'GET', // Ajout explicite de la méthode GET
        headers: {
          Authorization: authHeader,
        },
      });

      // Log complet de la requête
      console.log('Requête envoyée:', {
        url: 'https://huggingface.co/api/whoami-v2',
        method: 'GET',
        headers: {
          Authorization: authHeader.replace(this.token, '***'), // Masqué pour la sécurité
        },
      });

      // Log de la réponse complète pour debug
      const responseText = await testResponse.text();
      console.log('Response complète:', {
        status: testResponse.status,
        headers: Object.fromEntries(testResponse.headers.entries()),
        body: responseText,
      });

      if (!testResponse.ok) {
        throw new Error(`Erreur d'authentification: ${responseText}`);
      }

      const prompt = `
      <instructions>
      Tu es un assistant de programmation expert qui a une connaissance approfondie des dépôts GitHub suivants:
      ${repoList}
      
      En te basant uniquement sur le contexte fourni et ta compréhension générale du code, réponds à la question.
      Si tu ne trouves pas l'information dans le contexte, dis-le clairement.
      Cite toujours les fichiers sources pertinents dans ta réponse.
      </instructions>
      
      <context>
      ${context}
      </context>
      
      <question>
      ${question}
      </question>
      
      <answer>
      `;
      console.log('this.hf.:', this.hf);
      console.log('this.model,:', this.model);

      const response = await this.hf.textGeneration({
        // accessToken: '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',
        model: this.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
          do_sample: true,
        },
      });

      // const response = await hf.textGeneration({
      //   model: LLM_MODEL,
      //   inputs: prompt,
      //   parameters: {
      //     max_new_tokens: 1024,
      //     temperature: 0.1,
      //     top_p: 0.95,
      //     do_sample: true,
      //   },
      // });

      return response.generated_text.trim();
    } catch (error) {
      console.error('Erreur LLM détaillée:', {
        message: error.message,
        name: error.name,
        cause: error.cause,
        model: this.model,
      });

      if (error.message.includes('Invalid username or password')) {
        throw new Error('Token Hugging Face invalide. Veuillez vérifier votre configuration.');
      }

      if (error.message.includes('fetching the blob')) {
        throw new Error(
          "Erreur d'accès au modèle. Vérifiez que le modèle est accessible et que vous avez accepté les conditions d'utilisation sur Hugging Face."
        );
      }
      throw error;
    }
  }
}
