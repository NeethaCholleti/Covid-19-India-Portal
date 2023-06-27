const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
module.exports = app;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//middleware
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertoCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
   SELECT
    *
   FROM
    state
   ORDER BY
    state_id;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});
//API3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
   SELECT
    *
   FROM
    state
   WHERE 
    state_id= ${stateId};`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
    district (district_name,
    state_id,
    cases,
    cured,
    active,
    deaths)

    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
         
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  const districtId = dbResponse.lastID;
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `
   SELECT
    *
   FROM
    district
   WHERE 
    district_id= ${districtId};`;
    const districtsArray = await db.all(getDistrictsQuery);
    response.send(
      districtsArray.map((eachDistrict) => convertoCamelCase(eachDistrict))
    );
  }
);

//API6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    UPDATE
      district
    SET
       district_name= '${districtName}',
         state_id=${stateId},
         cases=${cases},
         cured=${cured},
        active= ${active},
         deaths=${deaths}
    WHERE
      district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesQuery = `
   SELECT
    SUM(cases) as totalCases,
    SUM(Cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
   FROM
    district
   WHERE 
    state_id= ${stateId};`;
    const statesArray = await db.all(getStatesQuery);
    response.send(statesArray);
  }
);
