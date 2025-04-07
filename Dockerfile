FROM node:18

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy remaining code
COPY . .

# Default command
CMD ["node", "github-rag.js"]