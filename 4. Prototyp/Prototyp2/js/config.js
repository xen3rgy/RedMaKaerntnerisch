// App-wide config
// mode: 'demo' = rule-based; 'live' = calls your local backend proxy.
const AppConfig = {
  mode: 'demo', // change to 'live' after starting backend
  live: {
    endpoint: 'http://localhost:8787/chat', // your proxy endpoint
    // Do NOT put API keys in the frontend. Keep keys on the server only.
    model: 'gpt-4o-mini', // free to change on server
    system_prompt: 'You are a helpful assistant that answers in logical German and then we apply a dialect post-processing layer.'
  }
};
