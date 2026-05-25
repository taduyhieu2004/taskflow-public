# Build context: ./code/taskflow-fe
# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .

# API URL được set qua build arg, ghi vào bundle Vite. Khi user mở FE qua
# browser sẽ gọi vào localhost:8080 (gateway expose ra host).
ARG VITE_API_URL=http://localhost:8080/api/v1
ARG VITE_WS_URL=http://localhost:8080/ws/notifications
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
