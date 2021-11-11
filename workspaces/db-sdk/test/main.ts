import "mocha/mocha";
import chai from "chai";
import { db, createDB, createStore, deleteDB, transaction } from "src/index";
import { dbName, dbStoreName, dbStoreName2 } from "./constant";

const { assert } = chai;

suite("创建db", () => {
  teardown("关闭db", async () => {
    if (db) db.close();
    await deleteDB(dbName);
  });

  test("createDB", async () => {
    await createDB(dbName);
    assert.instanceOf(db, IDBDatabase);
  });

  test("createDB name", async () => {
    await createDB(dbName);
    assert.equal(db.name, dbName);
  });
});

suite("创建store", () => {
  teardown("关闭db", async () => {
    if (db) db.close();
    await deleteDB(dbName);
  });

  test("createStores", async () => {
    const cstore = () => {
      createStore(dbStoreName);
    };
    await createDB(dbName, [cstore]);
    assert(
      Array.from(db.objectStoreNames).includes(dbStoreName),
      "存在命名dbStoreName的store"
    );
  });

  test("createStores with options", async () => {
    const cstore = () => {
      createStore(dbStoreName, { keyPath: "id" });
    };
    await createDB(dbName, [cstore]);

    const store = await db.transaction(dbStoreName).objectStore(dbStoreName);
    assert.equal(store.name, dbStoreName);
  });
});

suite("创建transaction", () => {
  suiteSetup("新建一个db", async () => {
    await createDB(dbName, [
      () =>
        createStore(dbStoreName, {
          keyPath: "id",
        }),
      () => createStore(dbStoreName2, { keyPath: "id" }),
    ]);
  });

  test("transaction", async () => {
    await transaction([dbStoreName, dbStoreName2], "readwrite")
      .add({
        storeName: dbStoreName,
        data: {
          id: "1",
          count: 2,
        },
      })
      .get(() => ({
        storeName: dbStoreName,
        key: "1",
      }))
      .add((data) => {
        return {
          storeName: dbStoreName2,
          data,
        };
      })
      .exec();
  });
});
