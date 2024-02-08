# Triquetra Project Setup with Hasura

To get started with the Triquetra project integrated with Hasura, follow these steps:

## Backend Setup

1. Clone this repository and open it in Visual Studio Code.
2. Ensure Docker Desktop is running.
3. Run the `start-backend.sh` file in the bash terminal from the root directory:

   ```bash
   ./start-backend.sh
   ```

4. Access the Hasura console at [http://localhost:9596](http://localhost:9695/) and enter the admin password `123`.
5. If you make any changes to the table, run the following command in the `frontend` folder to update the `api/zeus` folder:

   ```bash
   npm run zeus
   ```

6. In the `api/zeus` folder, locate the `index.ts` file and comment out the following two lines.

7. View the image for reference:

![image](https://github.com/pipesort/triquetra/assets/106590431/433ab894-5031-4ecf-925e-a1bc01a1b384)

## Frontend Setup

1. Navigate to the `frontend` directory using the command:

   ```bash
   cd frontend
   ```

2. Install the required dependencies:

   ```bash
   npm install
   ```

3. Start the frontend development server:

   ```bash
   npm run dev
   ```

Now, the Triquetra project is set up with Hasura, and both the backend and frontend are ready for development.
