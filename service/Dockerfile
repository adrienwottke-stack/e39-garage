ARG NODE_IMAGE=node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
FROM ${NODE_IMAGE}
ENV NODE_ENV=production ONNXRUNTIME_NODE_INSTALL=skip PORT=5191 HOST=0.0.0.0 DATA_DIR=/data MODEL_CACHE=/models MODEL_LOCAL_ONLY=1 NODE_OPTIONS=--max-old-space-size=384
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY catalog.mjs domain.mjs offers.mjs semantic.mjs server.mjs ./
USER node
EXPOSE 5191
CMD ["node","server.mjs"]
