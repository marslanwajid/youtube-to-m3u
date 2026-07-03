FROM node:20-alpine

# Install python3, ffmpeg, curl, and pip
RUN apk add --no-cache python3 ffmpeg curl py3-pip

# Install yt-dlp via pip so that it includes all necessary EJS solver scripts natively
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp

WORKDIR /app

# Copy package lock and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files and build
COPY . .
RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the Next.js production server
CMD ["npm", "start"]
