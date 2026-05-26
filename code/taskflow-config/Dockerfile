# Build context: ./code
# syntax=docker/dockerfile:1.6

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY taskflow-config /workspace/taskflow-config
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -f /workspace/taskflow-config/pom.xml package -DskipTests

FROM eclipse-temurin:17-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/taskflow-config/target/*.jar /app/app.jar
# Config-repo (filesystem backend) phải nằm trong cùng image
COPY --from=build /workspace/taskflow-config/config-repo /app/config-repo
EXPOSE 8888
ENTRYPOINT ["java","-jar","/app/app.jar"]
