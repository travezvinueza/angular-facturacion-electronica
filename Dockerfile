# Etapa 1: Construir el proyecto Angular.
FROM node:20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build --prod

# Etapa 2: Configurar Nginx para servir la aplicación
FROM nginx:alpine
COPY --from=build /app/dist/geolocalizacion/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
