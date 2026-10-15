# The ReSource web app as a static site. Build from the repository root (the app imports
# ../shared). EXPO_PUBLIC_API_URL is compiled in, so it must be the address the *browser* uses.
FROM node:22-slim AS build
WORKDIR /src
COPY app/package.json app/package-lock.json app/
RUN cd app && npm ci
COPY shared shared
COPY app app
ARG EXPO_PUBLIC_API_URL=http://localhost:8000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN cd app && npx expo export --platform web

FROM node:22-slim
RUN npm install --global serve@14
COPY --from=build /src/app/dist /site
USER node
EXPOSE 8080
# --single sends every unknown path to index.html, which the app's router needs.
CMD ["serve", "/site", "--single", "--listen", "8080", "--no-clipboard"]
