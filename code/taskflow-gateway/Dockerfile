# Build context: ./code
# syntax=docker/dockerfile:1.6

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY taskflow-gateway /workspace/taskflow-gateway
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -f /workspace/taskflow-gateway/pom.xml package -DskipTests

FROM eclipse-temurin:17-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/taskflow-gateway/target/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
