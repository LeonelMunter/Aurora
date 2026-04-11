export TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.com\",\"password\":\"Test1234\"}" \
  | grep -o '"accessToken":"[^"]*"' \
  | cut -d'"' -f4)

export PORTFOLIO_ID="dd3f7704-1a90-4a90-b83a-8e13270a0077"

echo "Variables cargadas"
echo "TOKEN: ${TOKEN:0:20}..."
echo "PORTFOLIO_ID: $PORTFOLIO_ID"