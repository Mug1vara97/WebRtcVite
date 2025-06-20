FROM node:18-bullseye

# Install dependencies for mediasoup
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000 40000-40100/udp 40000-40100/tcp

CMD ["npm", "start"] 