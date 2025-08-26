# Dockerfile simplificado para debugging

# Etapa 1: Build de la aplicación
FROM node:22.14.0-alpine as build-stage

# Establecer el directorio de trabajo
WORKDIR /app

# Instalar Angular CLI
RUN npm install -g @angular/cli@latest

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias
RUN npm ci --silent

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Verificar que el build se creó correctamente
RUN ls -la /app/dist/
RUN ls -la /app/dist/sakai-ng/

# Etapa 2: Servidor nginx
FROM nginx:1.25-alpine as production-stage

# PASO 1: Eliminar TODO el contenido por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*
RUN rm -rf /etc/nginx/conf.d/*

# PASO 2: Copiar nuestra configuración
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# PASO 3: Copiar archivos de Angular
COPY --from=build-stage /app/dist/sakai-ng /usr/share/nginx/html


# Exponer puerto
EXPOSE 80

# Comando para ejecutar nginx
CMD ["nginx", "-g", "daemon off;"]
