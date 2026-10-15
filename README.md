# Real Estate Agency CMS

A small real-estate agency website with a public project gallery and a password-protected admin dashboard.

## Features

- Public gallery for published projects
- Admin sign-in using an HTTP-only session cookie
- Create, edit, publish, unpublish, and delete projects
- MongoDB Atlas database
- Netlify Functions API
- Responsive layout
- Image URL support

## Stack

- React
- TypeScript
- Vite
- Netlify Functions
- MongoDB Atlas
- JSON Web Tokens
- bcrypt

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install

Copy .env.example to .env and fill in the values.
Start the local Netlify development server:
bash


npx netlify dev
The site will be available at the local URL printed by Netlify CLI.

Create an admin password hash
Run this command, replacing your-strong-password with a unique password:

bash


node -e "require('bcryptjs').hash('your-strong-password', 12).then(console.log)"
Copy the result into ADMIN_PASSWORD_HASH. Do not use the example password in production.

Generate a JWT secret with:

bash


node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
MongoDB Atlas
Create a MongoDB Atlas cluster and database user.
Copy the database connection string into MONGODB_URI.
Set MONGODB_DATABASE to the database name.
Configure Atlas Network Access for the environment hosting the API.
Use a database user with only the permissions this application needs.
Never put the MongoDB connection string in frontend code or a VITE_ variable. It must only be available to the server-side function.

Deploy to Netlify
Push the repository to GitHub.
In Netlify, import the GitHub repository.
Add these environment variables in the Netlify site settings:
MONGODB_URI
MONGODB_DATABASE
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
JWT_SECRET
Deploy the site.
Open /admin on the deployed site to sign in.
The frontend and API can be deployed with this repository. Check your MongoDB Atlas network-access requirements before production deployment: serverless functions may not use a fixed outbound IP on every plan. Do not leave the database broadly accessible as a permanent production setting.

Images
This starter accepts HTTPS image URLs. Upload images to an image hosting service such as Cloudinary, then paste the resulting URLs into the project form. The database stores URLs, not image files.

Before production
Use a unique, strong admin password and JWT secret.
Keep all secrets in Netlify environment variables.
Configure MongoDB Atlas network access carefully.
Add rate limiting to the login endpoint.
Add backups and test database restore procedures.
Review image upload permissions if direct uploads are added.
Add stronger validation and error monitoring for the agency's needs.