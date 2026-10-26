# RetroFlow UI

React UI for the RetroFlow API (`ai-track-ps-dev-retroflow-fork`).

```sh
# in ai-track-ps-dev-retroflow-fork
./mvnw spring-boot:run

# here
npm install
npm run dev   # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8080`, so the backend needs no CORS setup. Point it elsewhere with `RETROFLOW_API_URL=http://host:port npm run dev`.

Adding action items needs `POST /api/retrospectives/{id}/action-items` (decision D16 in the backend). The API has no endpoint to list teams or to add plain feedback, so the UI opens teams by id and shows action items only. The backend uses in-memory H2, so data is gone after a restart.
