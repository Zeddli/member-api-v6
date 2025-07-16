# Topcoder Member API v5

## Dependencies

- nodejs https://nodejs.org/en/ (v10)
- prisma
- PostgreSQL
- Docker, Docker Compose

## Database Setup

Please setup PostgreSQL first. If you are using docker, you can run:
```bash
docker run -d --name memberdb -p 5432:5432 \
  -e POSTGRES_USER=johndoe -e POSTGRES_DB=memberdb \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16
```

After that, please set db URL environment variables:
```bash
export DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/memberdb"
```

This variable is important since it's required by prisma.

If you want to do anything with database, this variable is necessary.

## Database Scripts

Before running db scripts, please make sure you have setup db and config db url as above.

```bash
# set db url values
export DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/memberdb"

# install dependencies
npm install
```

Here are some helpful scripts for db operations.

```bash
# create db tables
npm run init-db

# Clear all db data
npm run clear-db

# create test data
npm run seed-data

# Reset db
npm run reset-db
```

## Database Seed Data

I have created a script to download data from dev environment and a script to load them into db.

To use them, you should:
- Make sure you have started db.
- Check configs in `src/scripts/config.js`. Add some handle if you like.
- Open a terminal and navigate to codebase folder. Set `DATABASE_URL` above.
- Run `npm install`.
- Use `node src/scripts/download.js` to download profile data.
- Run `npm run clear-db` to clear db data first
- Run `npm run seed-data` to import data into db


## Configuration

Configuration for the application is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level, default is 'debug'
- PORT: the server port, default is 3000
- AUTH_SECRET: The authorization secret used during token verification.
- VALID_ISSUERS: The valid issuer of tokens.
- AUTH0_URL: AUTH0 URL, used to get M2M token
- AUTH0_PROXY_SERVER_URL: AUTH0 proxy server URL, used to get M2M token
- AUTH0_AUDIENCE: AUTH0 audience, used to get M2M token
- TOKEN_CACHE_TIME: AUTH0 token cache time, used to get M2M token
- AUTH0_CLIENT_ID: AUTH0 client id, used to get M2M token
- AUTH0_CLIENT_SECRET: AUTH0 client secret, used to get M2M token
- BUSAPI_URL: Bus API URL
- KAFKA_ERROR_TOPIC: Kafka error topic used by bus API wrapper
- GROUPS_API_URL: Groups API URL
- AMAZON.AWS_ACCESS_KEY_ID: The Amazon certificate key to use when connecting. 
- AMAZON.AWS_SECRET_ACCESS_KEY: The Amazon certificate access key to use when connecting.
- AMAZON.AWS.SESSION_TOKEN: The user session token, used when developing locally against the TC dev AWS services
- AMAZON.AWS_REGION: The Amazon certificate region to use when connecting.
- AMAZON.PHOTO_S3_BUCKET: the AWS S3 bucket to store photos
- AMAZON.S3_API_VERSION: the AWS S3 API version
- FILE_UPLOAD_SIZE_LIMIT: the file upload size limit in bytes
- PHOTO_URL_TEMPLATE: photo URL template, its <key> will be replaced with S3 object key
- VERIFY_TOKEN_EXPIRATION: verify token expiration in minutes
- EMAIL_VERIFY_AGREE_URL: email verify agree URL, the <emailVerifyToken> will be replaced with generated verify token
- EMAIL_VERIFY_DISAGREE_URL: email verify disagree URL
- SCOPES: the configurable M2M token scopes, refer `config/default.js` for more details
- MEMBER_SECURE_FIELDS: Member profile identifiable info fields, only admin, M2M, or member himself can fetch these fields
- COMMUNICATION_SECURE_FIELDS: Member contact information, accessible by admins, managers, and copilots - anyone with a role in the AUTOCOMPLETE_ROLES array
- MEMBER_TRAIT_SECURE_FIELDS: Member traits identifiable info fields, only admin, M2M, or member himself can fetch these fields
- MISC_SECURE_FIELDS: Misc identifiable info fields, only admin, M2M, or member himself can fetch these fields
- STATISTICS_SECURE_FIELDS: Member Statistics identifiable info fields, only admin, M2M, or member himself can fetch these fields
- HEALTH_CHECK_TIMEOUT: health check timeout in milliseconds

Set the following environment variables used by bus API to get TC M2M token (use 'set' insted of 'export' for Windows OS):
```
export AUTH0_CLIENT_ID=
export AUTH0_CLIENT_SECRET=
export AUTH0_URL=
export AUTH0_AUDIENCE=
```

Also properly configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, PHOTO_S3_BUCKET config parameters.

Test configuration is at `config/test.js`. You don't need to change them.
The following test parameters can be set in config file or in env variables:

- ADMIN_TOKEN: admin token
- USER_TOKEN: user token
- EXPIRED_TOKEN: expired token
- INVALID_TOKEN: invalid token
- M2M_FULL_ACCESS_TOKEN: M2M full access token
- M2M_READ_ACCESS_TOKEN: M2M read access token
- M2M_UPDATE_ACCESS_TOKEN: M2M update (including 'delete') access token
- S3_ENDPOINT: endpoint of AWS S3 API, for unit and e2e test only; default to `localhost:9000`

## AWS S3 Setup
Go to https://console.aws.amazon.com/ and login. Choose S3 from Service folder and click `Create bucket`. Following the instruction to create S3 bucket.
After creating bucket, click `Permissions` tab of the bucket, in the `Block public access` section, disable the block, so that public access
is allowed, then we can upload public accessible photo to the bucket.

## Local Mock Service

To make local development easier, I create a mock server at `mock`.

You can start it with `node mock/mock-api.js` and it will listen to port `4000`

This mock service will simulate request and responses for other APIs like auth0 and event bus API.

## Local Configs

Please run following commands to set necessary configs:

```bash
export AUTH0_URL="http://localhost:4000/v5/auth0"
export BUSAPI_URL="http://localhost:4000/v5"
export AUTH0_CLIENT_ID=xyz
export AUTH0_CLIENT_SECRET=xyz
export USERFLOW_PRIVATE_KEY=mysecret
export GROUPS_API_URL="http://localhost:4000/v5/groups"
```

These commands will set auth0 and event bus api to local mock server.

## Local Deployment

- Make sure you have started db and set `DATABASE_URL`.
- Make sure you have create db structure. Seed data is optional.
- Install dependencies `npm install`
- Start app `npm start`
- App is running at port 3000. You can visit `http://localhost:3000/v6/members/health`


## Tests


Make sure you have followed above steps to 
- setup db and config db url
- setup local mock api and set local configs
  - it will really call service and mock api


Then you can run:
```bash
npm run test
```

## Verification
Refer to the verification document `Verification.md`

## API Endpoints (Stats & Stats History)

The following endpoints are available for managing member statistics and stats history:

### Member Stats History
- `GET    /members/:handle/stats/history` - Get member's stats history
- `POST   /members/:handle/stats/history` - Create member's stats history
- `PATCH  /members/:handle/stats/history` - Partially update member's stats history

### Member Stats
- `GET    /members/:handle/stats` - Get member's stats
- `POST   /members/:handle/stats` - Create member's stats
- `PATCH  /members/:handle/stats` - Partially update member's stats

See the Postman collection in `docs/Member API.postman_collection.json` for example requests and responses.

## Using the Postman Collection

1. Open Postman and import the collection from `docs/Member API.postman_collection.json`.
2. Set the base URL and any required environment variables (e.g., tokens for private endpoints).
3. Use the provided requests to test all endpoints, including stats and stats history.

## Example Environment Variables

Create a `.env` file in the project root with the following (adjust as needed):

```
DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/memberdb"
PORT=3000
LOG_LEVEL=debug
# Add other variables as needed
```

## Detailed Setup Instructions

### 1. Clone the Repository
```bash
git clone <repo-url>
cd member-api-v6
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up PostgreSQL Database
You can use Docker or a native installation. For Docker:
```bash
docker run -d --name memberdb -p 5432:5432 \
  -e POSTGRES_USER=johndoe -e POSTGRES_DB=memberdb \
  -e POSTGRES_PASSWORD=mypassword \
  postgres:16
```

### 4. Configure Environment Variables
Create a `.env` file in the project root with the following content (adjust as needed):
```
DATABASE_URL="postgresql://johndoe:mypassword@localhost:5432/memberdb"
PORT=3000
LOG_LEVEL=debug
# AUTH_SECRET, AUTH0_URL, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, etc. as needed
```

#### Common Environment Variables
| Variable                | Description                                      | Example Value                                      |
|-------------------------|--------------------------------------------------|----------------------------------------------------|
| DATABASE_URL            | PostgreSQL connection string                     | postgresql://johndoe:mypassword@localhost:5432/memberdb |
| PORT                    | Port for API server                              | 3000                                               |
| LOG_LEVEL               | Log verbosity                                    | debug                                              |
| AUTH_SECRET             | JWT secret for authentication                    | your_jwt_secret                                    |
| AUTH0_URL               | Auth0 URL for M2M token                          | http://localhost:4000/v5/auth0                     |
| AUTH0_CLIENT_ID         | Auth0 client ID                                  | xyz                                                |
| AUTH0_CLIENT_SECRET     | Auth0 client secret                              | xyz                                                |
| BUSAPI_URL              | Bus API URL                                      | http://localhost:4000/v5                           |
| GROUPS_API_URL          | Groups API URL                                   | http://localhost:4000/v5/groups                    |
| ...                     | ...                                              | ...                                                |

> See `config/default.js` for a full list and descriptions of all supported variables.

### 5. Initialize the Database
```bash
npm run init-db
```

### 6. Seed the Database with Test Data
```bash
npm run seed-data
```

### 7. Start the Application
```bash
npm start
```
The API will be available at `http://localhost:3000` (or your configured port).

### 8. (Optional) Start the Local Mock Service
If you want to mock external dependencies:
```bash
node mock/mock-api.js
```
This will start a mock server on port 4000.

## Test Instructions

### 1. Prerequisites
- Ensure the database is running and seeded.
- Ensure all environment variables are set (see above).
- (Optional) Start the mock service if you want to mock external APIs.

### 2. Run Tests
```bash
npm test
```
This will run all unit and integration tests. All tests should pass if setup is correct.

### 3. Troubleshooting
- **Database connection errors:**
  - Ensure PostgreSQL is running and accessible at the `DATABASE_URL`.
  - Check that the user, password, and database name are correct.
- **Seeding errors:**
  - Make sure the database is initialized (`npm run init-db`) before seeding.
- **Port conflicts:**
  - Change the `PORT` in your `.env` file if 3000 is in use.
- **Missing environment variables:**
  - Double-check your `.env` file and `config/default.js` for required variables.

## API Testing with Postman
- Import the collection from `docs/Member API.postman_collection.json`.
- Use the provided requests to test all endpoints.
- Set any required tokens or variables in your Postman environment.

## Common Errors and Solutions

### 1. Database Connection Errors
- **Error:** `psql: error: connection to server on socket ... failed: No such file or directory`
  - **Solution:** Ensure PostgreSQL is running. Start it with `sudo service postgresql start` (Linux/WSL) or use Docker as described above.

- **Error:** `PrismaClientInitializationError: Environment variable not found: DATABASE_URL.`
  - **Solution:** Set the `DATABASE_URL` environment variable in your `.env` file or export it in your shell.

- **Error:** `FATAL: password authentication failed for user ...`
  - **Solution:** Double-check your database username and password in `DATABASE_URL`. Ensure the user exists in your Postgres instance.

### 2. Port Conflicts
- **Error:** `EADDRINUSE: address already in use ...`
  - **Solution:** Change the `PORT` in your `.env` file to a free port, or stop the process using the port.

### 3. Missing Environment Variables
- **Error:** `PrismaClientInitializationError: Environment variable not found: ...`
  - **Solution:** Ensure all required variables are set in your `.env` file. See the environment variables section above and `config/default.js` for a full list.

### 4. Database Migration/Seeding Errors
- **Error:** `relation "..." does not exist` or migration errors
  - **Solution:** Run `npm run init-db` to initialize the database schema before seeding or starting the app.

- **Error:** Seeding script fails
  - **Solution:** Ensure the database is initialized and accessible. Check for typos or missing data in your seed scripts.

### 5. Authentication/Token Issues
- **Error:** `401 Unauthorized` or `403 Forbidden` when calling endpoints
  - **Solution:** Ensure you are providing a valid JWT token in your request headers. For private endpoints, use the correct token from your Auth0 or mock service.

### 6. Test Failures
- **Error:** Tests fail due to missing data or connection errors
  - **Solution:** Ensure the database is seeded and all environment variables are set before running tests. Start the mock service if required.

### 7. Docker Issues
- **Error:** `Error response from daemon: ... port is already allocated`
  - **Solution:** Stop any running containers using the port, or change the port mapping in your Docker command.

### 8. Prisma Client Errors
- **Error:** `Error: P1001: Can't reach database server at ...`
  - **Solution:** Ensure your database server is running and accessible at the address in `DATABASE_URL`.

If you encounter an error not listed here, check the logs for more details or consult the documentation for the relevant tool (Node.js, Prisma, PostgreSQL, Docker, etc.).

## Seed Data for Testing and Validation

The file `test_data.json` in the project root contains all required data for testing and validating your submission. This file includes sample members, statistics, stats history, skills, and related entities, structured to match the database schema.

### How to Use
1. Ensure your database is initialized (`npm run init-db`).
2. Run the seeding script:
   ```bash
   npm run seed-data
   ```
   This will load the data from `test_data.json` into your local database using Prisma.

### What It Contains
- Member profiles and handles
- Member statistics and stats history (including sub-items)
- Skills, categories, and levels
- All data needed to fully exercise and validate the API endpoints

If you modify or add to the test data, rerun the seeding script to update your database.
