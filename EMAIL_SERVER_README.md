# Fast Forward Logistics - Email Server Setup

This Node.js/Express backend handles email notifications for contact and quote forms submitted through the FFL website.

## Features

✅ Sends contact form submissions to support@fastforwardlogistics.express  
✅ Sends quote requests with calculated estimates  
✅ Uses Hostinger SMTP server (smtp.hostinger.com:465)  
✅ Professional HTML and plain text email formatting  
✅ CORS-enabled for frontend integration  
✅ Error handling and logging

## Prerequisites

- Node.js v14+ and npm
- Hostinger email account with SMTP access
- The FFL website running on your domain or locally

## Installation

### 1. Install Dependencies

```bash
cd /Users/macbookair/Desktop/FFL
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and verify credentials:

```
EMAIL_USER=support@fastforwardlogistics.express
EMAIL_PASS=Goodboy@419
PORT=5000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,https://fastforwardlogistics.express
```

> ⚠️ **Security Note**: Never commit `.env` to version control. The `.env` file is already in `.gitignore`.

## Running the Server

### Development (with auto-reload)

```bash
npm run dev
```

### Production

```bash
npm start
```

The server will start on `http://localhost:5000`

### Test the Connection

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{ "status": "ok", "timestamp": "2026-08-01T..." }
```

## API Endpoints

### POST /api/contact

Sends a contact form submission as email

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Corp",
  "phone": "+1234567890",
  "destination": "USA Shipping Inquiry",
  "notes": "I need information about ocean freight rates",
  "reference": "FFLC-ABC123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "..."
}
```

### POST /api/quote

Sends a quote request with estimate as email

**Request Body:**

```json
{
  "reference": "FFLQ-ABC123",
  "mode": "air",
  "region": "usa",
  "origin": "Iraq",
  "destination": "New York",
  "weight": "100",
  "volume": "0.5",
  "commodity": "Electronics",
  "ready_date": "2026-08-15",
  "name": "Jane Smith",
  "company": "Tech Solutions",
  "email": "jane@techsolutions.com",
  "phone": "+1234567890",
  "notes": "Rush shipment needed",
  "estimate_low": 500,
  "estimate_high": 750
}
```

**Response:**

```json
{
  "success": true,
  "message": "Quote email sent successfully",
  "messageId": "..."
}
```

## Frontend Integration

The form handling in `assest/js/Quote.js` automatically sends data to these endpoints when forms are submitted.

### Contact Form (contact.html)

- Submits to `/api/contact`
- Email is sent to support@fastforwardlogistics.express
- User receives confirmation with reference number

### Quote Form (Quote.html, etc.)

- Submits to `/api/quote`
- Includes calculated estimate in email
- Email is sent to support@fastforwardlogistics.express
- User receives confirmation with reference number

## Email Templates

Emails are formatted with:

- HTML for rich formatting
- Plain text fallback for compatibility
- Shipment details clearly formatted
- Reference number for tracking
- Timestamp of submission
- Reply-to set to customer's email

## Deployment

### Option 1: Heroku

```bash
# Install Heroku CLI, then:
heroku create ffl-email-server
heroku config:set EMAIL_USER=support@fastforwardlogistics.express
heroku config:set EMAIL_PASS=Goodboy@419
git push heroku main
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t ffl-email-server .
docker run -e EMAIL_USER=support@fastforwardlogistics.express -e EMAIL_PASS=Goodboy@419 -p 5000:5000 ffl-email-server
```

### Option 3: On Your Own Server

```bash
# SSH into your server
ssh user@your-server.com

# Clone the repo
git clone https://github.com/OBSBANKGROUP/FFL-Shipping-website.git
cd FFL-Shipping-website

# Install dependencies
npm install --production

# Create .env file
nano .env
# Add EMAIL_USER, EMAIL_PASS, PORT, etc.

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name "ffl-email-server"
pm2 save
```

## Environment Variables Reference

| Variable          | Required | Default    | Description                            |
| ----------------- | -------- | ---------- | -------------------------------------- |
| `EMAIL_USER`      | Yes      | -          | Hostinger email address                |
| `EMAIL_PASS`      | Yes      | -          | Hostinger email password               |
| `PORT`            | No       | 5000       | Port to run the server on              |
| `NODE_ENV`        | No       | production | Environment mode                       |
| `ALLOWED_ORIGINS` | No       | -          | CORS allowed origins (comma-separated) |
| `LOG_EMAILS`      | No       | false      | Enable email logging                   |

## Troubleshooting

### Email Not Sending

1. **Check Hostinger credentials:**

   ```bash
   node -e "const nm = require('nodemailer'); const t = nm.createTransport({host:'smtp.hostinger.com',port:465,secure:true,auth:{user:'support@fastforwardlogistics.express',pass:'Goodboy@419'}}); t.verify(console.log);"
   ```

2. **Check server logs:**

   ```bash
   npm run dev
   # Look for error messages
   ```

3. **Enable email logging:**
   - Set `LOG_EMAILS=true` in `.env`
   - Check console output for detailed logs

### CORS Errors

- Update `ALLOWED_ORIGINS` in `.env` to include your domain
- Restart the server

### Port Already in Use

- Change `PORT` in `.env` to an available port
- Or kill the process using the port:
  ```bash
  lsof -ti:5000 | xargs kill -9
  ```

## Security Considerations

- ✅ Never commit `.env` file
- ✅ Use environment variables for sensitive data
- ✅ Implement rate limiting for production (optional)
- ✅ Validate all inputs on both frontend and backend
- ✅ Use HTTPS in production
- ✅ Keep dependencies updated: `npm audit fix`

## Support

For issues or questions:

- Email: support@fastforwardlogistics.express
- GitHub: https://github.com/OBSBANKGROUP/FFL-Shipping-website

---

**Last Updated:** August 1, 2026
