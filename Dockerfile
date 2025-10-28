FROM node:latest
# 2 Set working directory inside container
WORKDIR /app

# 3️ Copy package.json and package-lock.json first (for caching dependencies)
COPY package*.json ./

# 4️Install dependencies
RUN npm install --only=production

# 5️ Copy the rest of the application
COPY . .

# 6️Expose port (same as your app listens on)
EXPOSE 3000
# 7️Start the application
CMD ["npm", "run","start"]
