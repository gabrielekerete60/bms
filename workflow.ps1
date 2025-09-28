# 1. Create the .github/workflows directory
mkdir -p .github\workflows

# 2. Define and write the workflow content to the file
$WorkflowContent = @'
name: Next.js Build and Deploy

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
    
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Generate Static Build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.NEXT_PUBLIC_FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_APP_ID }}
          NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }}
          
          NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: ${{ secrets.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY }}
          PAYSTACK_SECRET_KEY: ${{ secrets.PAYSTACK_SECRET_KEY }}

          SEED_PASSWORD: ${{ secrets.SEED_PASSWORD }}

        run: npm run build

      - name: Deploy Built Artifacts to gh-pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out 
          publish_branch: gh-pages 
          commit_message: Automated deployment from ${{ github.sha }}
'@

$WorkflowContent | Out-File .github\workflows\build-deploy.yml -Encoding UTF8