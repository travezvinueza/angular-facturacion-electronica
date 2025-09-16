FROM node:22.14.0-alpine as build-stage

WORKDIR /app
RUN npm install -g @angular/cli@latest

COPY package*.json ./
RUN npm ci --silent

COPY . .

RUN ng build --configuration=production

# Verificaciones
RUN ls -la /app/dist/sakai-ng/
RUN find /app/dist/sakai-ng -name "*.js" | head -5

FROM nginx:1.25-alpine AS production-stage

RUN rm -rf /usr/share/nginx/html/*
RUN rm -rf /etc/nginx/conf.d/*

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build-stage /app/dist/sakai-ng /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
