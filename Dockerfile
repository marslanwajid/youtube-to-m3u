FROM node:20-alpine

# Install python3, ffmpeg, curl (required by yt-dlp)
RUN apk add --no-cache python3 ffmpeg curl

# Download the latest yt-dlp binary and make it executable globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

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
