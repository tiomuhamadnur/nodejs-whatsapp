# Gunakan Node.js 22 (Current) sebagai base image
FROM node:22

# Set working directory
WORKDIR /usr/src/app

# Salin package.json & package-lock.json dulu (untuk caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Salin semua file project
COPY . .

# Buka port (misal 3000, ganti sesuai kebutuhan)
EXPOSE 3000

# Command untuk run app
CMD ["node", "index.js"]
