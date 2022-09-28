const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
var { format, isValid } = require("date-fns");

const databasePath = path.join(__dirname, "todoApplication.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const hasPriorityAndStatusProperties = (requestQuery) => {
  return (
    requestQuery.priority !== undefined && requestQuery.status !== undefined
  );
};

const hasCategoryAndStatusProperty = (requestQuery) => {
  return (
    requestQuery.category !== undefined && requestQuery.status !== undefined
  );
};

const hasCategoryAndPriorityProperty = (requestQuery) => {
  return (
    requestQuery.category !== undefined && requestQuery.priority !== undefined
  );
};

const hasCategoryProperty = (requestQuery) => {
  return requestQuery.category !== undefined;
};

const hasPriorityProperty = (requestQuery) => {
  return requestQuery.priority !== undefined;
};

const hasStatusProperty = (requestQuery) => {
  return requestQuery.status !== undefined;
};

const convertTodoToJson = (dbObject) => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    priority: dbObject.priority,
    status: dbObject.status,
    category: dbObject.category,
    dueDate: dbObject.due_date,
  };
};

const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
const priorityArray = ["HIGH", "LOW", "MEDIUM"];
const categoryArray = ["WORK", "LEARNING", "HOME"];

const formatDate = (date) => {
  return format(new Date(date), "yyyy-MM-dd");
};

app.get("/todos/", async (request, response) => {
  let requestedQueryName = "";
  let data = null;
  let getTodosQuery = "";
  const { search_q = "", priority, status, category } = request.query;
  console.log(search_q);
  switch (true) {
    case hasPriorityAndStatusProperties(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${status}'
        AND priority = '${priority}';`;
      break;
    case hasPriorityProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND priority = '${priority}';`;
      requestedQueryName = "Todo Priority";
      break;
    case hasStatusProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${status}';`;
      requestedQueryName = "Todo Status";
      break;
    case hasCategoryProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND category = '${category}';`;
      requestedQueryName = "Todo Category";
      break;
    case hasCategoryAndStatusProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${status}'
        AND category = '${category}';`;
      break;
    case hasCategoryAndPriorityProperty(request.query):
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%'
        AND status = '${priority}'
        AND category = '${category}';`;
      break;
    default:
      getTodosQuery = `
      SELECT
        *
      FROM
        todo 
      WHERE
        todo LIKE '%${search_q}%';`;
      requestedQueryName = "search";
  }

  data = await database.all(getTodosQuery);
  const dataLength = data.length;
  if (dataLength === 0) {
    response.status(400);
    response.send(`Invalid ${requestedQueryName}`);
  } else {
    response.send(data.map((each) => convertTodoToJson(each)));
  }
});

app.get("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const getTodosQuery = `
    SELECT
      *
    FROM
      todo
    WHERE
      id = ${todoId};`;
  const todo = await database.get(getTodosQuery);
  response.send(convertTodoToJson(todo));
});

app.get("/agenda/", async (request, response) => {
  const { date } = request.query;

  if (date === undefined) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    const isDateValid = isValid(new Date(date));

    if (isDateValid) {
      const formattedDate = formatDate(date);

      const getDueDateTodo = `
                SELECT
                    *
                FROM
                    todo
                WHERE due_date = '${formattedDate}';
            `;
      const todos = await database.all(getDueDateTodo);
      response.send(todos.map((todo) => convertTodoToJson(todo)));
    } else {
      response.status(400);
      response.send("Invalid Due Date");
    }
  }
});

app.post("/todos/", async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  try {
    const formattedDate = formatDate(dueDate);
    const isDateValid = isValid(new Date(formattedDate));

    if (!statusArray.includes(status)) {
      response.status(400);
      response.send("Invalid Todo Status");
    } else if (!priorityArray.includes(priority)) {
      response.status(400);
      response.send("Invalid Todo Priority");
    } else if (!categoryArray.includes(category)) {
      response.status(400);
      response.send("Invalid Todo Category");
    } else if (isDateValid !== true) {
      response.status(400);
      response.send("Invalid Due Date");
    } else {
      const postTodoQuery = `
    INSERT INTO
      todo (id,todo,priority,status,category,due_date) 
    VALUES (
      ${id},'${todo}','${priority}','${status}','${category}','${formattedDate}'
    );
    `;
      await database.run(postTodoQuery);
      response.send("Todo Successfully Added");
    }
  } catch (e) {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  let updateColumn = "";
  const requestBody = request.body;
  let formattedDate;
  switch (true) {
    case requestBody.todo !== undefined:
      updateColumn = "Todo";
      break;
    case requestBody.status !== undefined:
      if (!statusArray.includes(requestBody.status)) {
        response.status(400);
        response.send("Invalid Todo Status");
      } else {
        updateColumn = "Status";
      }
      break;
    case requestBody.priority !== undefined:
      if (!priorityArray.includes(requestBody.priority)) {
        response.status(400);
        response.send("Invalid Todo Priority");
      } else {
        updateColumn = "Priority";
      }
      break;
    case requestBody.category !== undefined:
      if (!categoryArray.includes(requestBody.category)) {
        response.status(400);
        response.send("Invalid Todo Category");
      } else {
        updateColumn = "Category";
      }
      break;
    case requestBody.dueDate !== undefined:
      try {
        formattedDate = formatDate(requestBody.dueDate);
        const isDateValid = isValid(new Date(formattedDate));
        if (isDateValid === false) {
          response.status(400);
          response.send("Invalid Due Date");
        } else {
          updateColumn = "Due Date";
        }
      } catch (e) {
        response.status(400);
        response.send("Invalid Due Date");
      }
      break;
  }
  if (updateColumn !== "") {
    const previousTodoQuery = `SELECT * FROM todo WHERE id = ${todoId}`;
    const previousTodo = await database.get(previousTodoQuery);
    const {
      todo = previousTodo.todo,
      status = previousTodo.status,
      priority = previousTodo.priority,
      category = previousTodo.category,
      dueDate = previousTodo.due_date,
    } = request.body;
    const updateTodoQuery = `
      UPDATE
        todo
      SET
        todo = '${todo}',
        status = '${status}',
        priority = '${priority}',
        category = '${category}',
        due_date = '${formattedDate}'
      WHERE
        id = ${todoId}
      `;
    await database.run(updateTodoQuery);
    response.send(`${updateColumn} Updated`);
  }
});

app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `
  DELETE FROM
    todo
  WHERE
    id = ${todoId};`;

  await database.run(deleteTodoQuery);
  response.send("Todo Deleted");
});

module.exports = app;
