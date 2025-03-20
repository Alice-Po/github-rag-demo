import { HfInference } from '@huggingface/inference';

export class LLMService {
  constructor(model, token) {
    if (!token) {
      throw new Error('Token Hugging Face manquant');
    }
    this.hf = new HfInference(token);
    this.model = model;
  }

  async generateAnswer(question, context, repoList) {
    try {
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

      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.1,
          top_p: 0.95,
          do_sample: true,
        },
      });

      return response.generated_text.trim();
    } catch (error) {
      console.error('Erreur LLM:', error);
      if (error.message.includes('Invalid username or password')) {
        throw new Error('Token Hugging Face invalide. Veuillez vérifier votre configuration.');
      }
      throw error;
    }
  }
}
