FROM docker.io/amazon/aws-cli:latest AS aws-cli
FROM docker.io/library/eclipse-temurin:25 AS eclipse-temurin

FROM node:lts-slim

# Install basic utilities
RUN apt-get update && \
    apt-get install -y \
        git \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Install AWS Cli
ENV AWS_CLI_HOME=/usr/local/aws-cli
COPY --from=aws-cli $AWS_CLI_HOME $AWS_CLI_HOME
COPY --from=aws-cli /usr/local/bin/ /usr/local/bin/

# Install Java
ENV JAVA_HOME=/opt/java/openjdk
COPY --from=eclipse-temurin $JAVA_HOME $JAVA_HOME

ENV PATH="${AWS_CLI_HOME}:${JAVA_HOME}/bin:${PATH}"

# Install pnpm
RUN corepack enable && \
    corepack prepare pnpm@latest --activate

RUN npx playwright install-deps

# Switch to node user
USER node
ENV PNPM_HOME="/home/node/.pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN pnpm add -g @anthropic-ai/claude-code && \
    pnpm add -g @playwright/cli

# Keep container running
CMD ["sleep", "infinity"]
