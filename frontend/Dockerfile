# ---------- Stage 1: Build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependencias primero (mejor caché)
COPY package*.json ./
RUN npm ci

# Copia el resto y construye
COPY . .
RUN npm run build

# ---------- Stage 2: Serve ----------
FROM nginx:1.27-alpine AS runtime

# Config SPA: fallback a index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia el resultado del build a Nginx
# Cambia /app/dist por /app/build si tu framework genera build/
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
