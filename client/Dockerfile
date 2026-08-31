FROM node:20-alpine AS builder
WORKDIR /app
# Install build tools and vips-dev to prevent sharp package network timeouts
RUN apk add --no-cache python3 make g++ vips-dev
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
