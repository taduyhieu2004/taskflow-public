# Build context: ./code
# syntax=docker/dockerfile:1.6

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY taskflow-events-contract /workspace/taskflow-events-contract
COPY taskflow-common /workspace/taskflow-common
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -f /workspace/taskflow-events-contract/pom.xml install -DskipTests \
 && mvn -B -f /workspace/taskflow-common/pom.xml install -DskipTests
COPY taskflow-task /workspace/taskflow-task
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -f /workspace/taskflow-task/pom.xml package -DskipTests

FROM eclipse-temurin:17-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /workspace/taskflow-task/target/*.jar /app/app.jar
EXPOSE 8083
ENTRYPOINT ["java","-jar","/app/app.jar"]
