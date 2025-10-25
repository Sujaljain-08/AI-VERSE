# Azure Container Instances Deployment Guide

Deploy your FastAPI ML server to Azure Container Instances using your Azure AI Foundry credits.

## Prerequisites

- ✅ Azure account with AI Foundry 300 credits
- ✅ Docker installed locally
- ✅ Azure CLI installed: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
- ✅ GitHub repository pushed (already done)

---

## Step 1: Install Azure CLI

```powershell
# Windows (PowerShell)
choco install azure-cli
# OR download from: https://aka.ms/installazurecliwindows

# Verify installation
az --version
```

---

## Step 2: Login to Azure

```powershell
az login

# This opens a browser. Sign in with your Azure account
# After login, select your subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

---

## Step 3: Create Azure Container Registry (ACR)

```powershell
# Set variables
$RESOURCE_GROUP = "aiverse-rg"
$REGISTRY_NAME = "aiversemlregistry"
$LOCATION = "eastus"

# Create resource group
az group create `
  --name $RESOURCE_GROUP `
  --location $LOCATION

# Create container registry
az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $REGISTRY_NAME `
  --sku Basic
```

---

## Step 4: Build and Push Docker Image

```powershell
# Navigate to project root
cd "C:\Users\Sujal B\OneDrive\Desktop\EXAM_FACE_DETECTION"

# Build image locally (optional test)
docker build -t aiverse-ml:latest -f Dockerfile .

# Test locally (optional)
docker run -p 8000:8000 aiverse-ml:latest

# Login to ACR
az acr login --name $REGISTRY_NAME

# Tag image for ACR
docker tag aiverse-ml:latest $REGISTRY_NAME.azurecr.io/aiverse-ml:latest

# Push to Azure Container Registry
docker push $REGISTRY_NAME.azurecr.io/aiverse-ml:latest

# Verify image is in registry
az acr repository list --name $REGISTRY_NAME
```

---

## Step 5: Deploy to Azure Container Instances

```powershell
# Set variables
$CONTAINER_NAME = "aiverse-ml-server"
$IMAGE = "$REGISTRY_NAME.azurecr.io/aiverse-ml:latest"
$REGISTRY_URL = "$REGISTRY_NAME.azurecr.io"

# Get ACR credentials
$LOGIN_SERVER = az acr show --name $REGISTRY_NAME --query loginServer --output tsv
$USERNAME = az acr credential show --name $REGISTRY_NAME --query "username" --output tsv
$PASSWORD = az acr credential show --name $REGISTRY_NAME --query "passwords[0].value" --output tsv

# Deploy to Container Instances
az container create `
  --resource-group $RESOURCE_GROUP `
  --name $CONTAINER_NAME `
  --image $IMAGE `
  --cpu 1 `
  --memory 1 `
  --registry-login-server $LOGIN_SERVER `
  --registry-username $USERNAME `
  --registry-password $PASSWORD `
  --ports 8000 `
  --protocol TCP `
  --environment-variables `
    PYTHONUNBUFFERED=1 `
  --ip-address public `
  --dns-name-label aiverse-ml
```

---

## Step 6: Get Your Public URL

```powershell
# Get container details
az container show `
  --resource-group $RESOURCE_GROUP `
  --name $CONTAINER_NAME `
  --query ipAddress.fqdn `
  --output tsv

# Output will be something like:
# aiverse-ml.region.azurecontainer.io
```

---

## Step 7: Test Your Deployment

```bash
# Test FastAPI docs endpoint
curl https://aiverse-ml.region.azurecontainer.io/docs

# Test WebSocket connection
# Use wscat
npm install -g wscat
wscat -c wss://aiverse-ml.region.azurecontainer.io/analyze
```

---

## Step 8: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your AI-VERSE project
3. Settings → Environment Variables
4. Add/Update:
   ```
   NEXT_PUBLIC_ML_SERVER_URL=wss://aiverse-ml.region.azurecontainer.io/analyze
   ```
5. Redeploy

---

## Step 9: Update Supabase Auth (if not done yet)

1. Go to https://app.supabase.com
2. Select your project
3. Authentication → URL Configuration
4. Add Site URL: `https://your-vercel-app.vercel.app`
5. Add Redirect URLs:
   ```
   http://localhost:3000/auth/callback
   https://your-vercel-app.vercel.app/auth/callback
   ```

---

## Monitoring & Logs

### View Container Logs

```powershell
az container logs `
  --resource-group $RESOURCE_GROUP `
  --name $CONTAINER_NAME
```

### Monitor Performance

```powershell
# Get container status
az container show `
  --resource-group $RESOURCE_GROUP `
  --name $CONTAINER_NAME

# Get detailed info
az container show `
  --resource-group $RESOURCE_GROUP `
  --name $CONTAINER_NAME `
  --query "{State:instanceView.state, Containers:containers, IpAddress:ipAddress.ip}"
```

---

## Cost Estimate

**Azure Container Instances Pricing:**
- vCPU: $0.0000252/second (~$20/month for 1 vCPU always-on)
- Memory: $0.0000126/GB-second (~$10/month for 1 GB always-on)
- **Total: ~$30/month** (heavily subsidized by your 300 credits)

**Your 300 credits cover:** ~10 months of continuous operation

---

## Auto-Update from GitHub (Optional)

For automatic deployment when you push to GitHub:

### Option A: GitHub Actions (Recommended)

Create `.github/workflows/deploy-to-azure.yml`:

```yaml
name: Deploy to Azure Container Instances

on:
  push:
    branches: [ main ]
    paths:
      - 'model_prediction/**'
      - 'Dockerfile'
      - '.github/workflows/deploy-to-azure.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Build and push image
      uses: azure/CLI@v1
      with:
        inlineScript: |
          az acr build --registry ${{ secrets.REGISTRY_NAME }} \
            --image aiverse-ml:latest \
            --file Dockerfile .
    
    - name: Restart container
      uses: azure/CLI@v1
      with:
        inlineScript: |
          az container restart \
            --resource-group ${{ secrets.RESOURCE_GROUP }} \
            --name aiverse-ml-server
```

Then add GitHub Secrets:
- `AZURE_CREDENTIALS` - From `az ad sp create-for-rbac`
- `REGISTRY_NAME` - Your ACR name
- `RESOURCE_GROUP` - Your resource group name

---

## Troubleshooting

### Container won't start

```powershell
# Check logs
az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME

# Common issue: Port mapping
# Make sure port 8000 is exposed in Dockerfile and ACI
```

### WebSocket connection fails

```powershell
# Check if container is running
az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME

# Verify FQDN is correct
az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query ipAddress.fqdn
```

### High memory usage

- Reduce to 0.5 GB memory if low traffic
- Or scale up to multiple instances with load balancer

---

## Next Steps

1. ✅ Set up ACR and push Docker image
2. ✅ Deploy to Container Instances
3. ✅ Get public URL
4. ✅ Update Vercel environment variables
5. ✅ Test end-to-end exam flow
6. ✅ Monitor logs and performance

---

## Quick Command Reference

```powershell
# View all your Azure resources
az resource list --query "[].{name:name, type:type}"

# Delete entire resource group (if needed)
az group delete --name $RESOURCE_GROUP

# Scale container
az container update --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --cpu 2 --memory 2
```

---

## Getting Help

- **Azure CLI Docs:** https://learn.microsoft.com/en-us/cli/azure/
- **Container Instances:** https://learn.microsoft.com/en-us/azure/container-instances/
- **FastAPI on Azure:** https://learn.microsoft.com/en-us/azure/developer/python/tutorial-containerize-deploy-python-web-app

