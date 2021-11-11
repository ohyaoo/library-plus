import omit from "lodash/omit";

let db: IDBDatabase;

function createDB(
  dbName: string,
  createStores?: (() => void)[]
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.addEventListener("error", () => {
      reject("db创建失败");
    });

    request.addEventListener("success", () => {
      db = request.result;
      resolve(db);
    });

    // 创建数据库或者更新数据库版本时触发
    request.addEventListener("upgradeneeded", () => {
      db = request.result;
      if (createStores) {
        Promise.all(createStores.map((create) => create())).catch((error) => {
          reject(error);
        });
      }
    });
  });
}

function deleteDB(dbName: string): Promise<void> {
  return new Promise((resolve) => {
    const request = window.indexedDB.deleteDatabase(dbName);
    request.addEventListener("success", () => {
      resolve();
    });
  });
}

interface createStoreOptions {
  keyPath?: string;
  autoIncrement?: boolean;
  indexs?: indexOptions[];
}

interface indexOptions {
  indexName: string;
  indexPath: string;
}

function createStore(storeName: string, options?: createStoreOptions) {
  let indexs: indexOptions[] = [];
  if (options && "indexs" in options) {
    ({ indexs } = omit(options, "indexs") as unknown as {
      indexs: indexOptions[];
    });
  }
  const store = db.createObjectStore(storeName, options);

  indexs.map(({ indexName, indexPath }) =>
    store.createIndex(indexName, indexPath)
  );
}

type callback = {
  (params?: any): IDBRequest;
};

interface IDBCursorWithValue extends IDBCursor {
  value: any;
}

interface transactionOptionObj {
  storeName: string;
  index?: string;
  key?: string;
  data?: any;
}

interface transactionOptionFn {
  (params?: any): transactionOptionObj;
}

type transactionOption = transactionOptionFn | transactionOptionObj;

interface transactionBase {
  exec: {
    (key?: string): Promise<any>;
  };
  getAll: {
    (option: transactionOption): transactionBase;
  };
  get: {
    (option: transactionOption): transactionBase;
  };
  add: {
    (option: transactionOption): transactionBase;
  };
  put: {
    (option: transactionOption): transactionBase;
  };
  delete: {
    (option: transactionOption): transactionBase;
  };
  search: {
    (option: transactionOption): transactionBase;
  };
}

function transaction(storeNames: string | string[], mode?: IDBTransactionMode) {
  const tx = db.transaction(storeNames, mode);
  const fns: callback[] = [];
  const result: transactionBase = {
    exec(primaryKey) {
      return new Promise((resolve, reject) => {
        let _res: any;
        tx.oncomplete = function oncomplete() {
          resolve(_res);
        };
        tx.onerror = function onerror() {
          reject();
        };
        tx.onabort = function onabort() {
          reject();
        };
        // 递归执行fns
        function reduce(res?: any) {
          if (fns.length === 0) {
            return;
          }

          const fn: callback | undefined = fns.shift();

          if (fn) {
            const request = fn(res);
            if (request.source instanceof IDBIndex) {
              _res = [];
            }
            request.onsuccess = function onsuccess(event: Event) {
              if (request.source instanceof IDBIndex) {
                const cursor = (
                  event.target as unknown as { result: IDBCursorWithValue }
                ).result;
                if (cursor) {
                  const { value } = cursor;
                  if (primaryKey) {
                    value[primaryKey] = cursor.primaryKey;
                  }
                  _res.push(value);
                  cursor.continue();
                } else {
                  reduce(_res);
                }
                return;
              }
              _res = (event.target as unknown as { result: any }).result;
              reduce(_res);
            };
            request.onerror = function onerror() {
              console.log("error");
            };
          }
        }
        reduce();
      });
    },
    getAll(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName } = _option;
        return tx.objectStore(storeName).getAll();
      });
      return result;
    },
    get(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName, key } = _option;
        return tx.objectStore(storeName).get(key as string);
      });
      return result;
    },
    add(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName, data } = _option;
        return tx.objectStore(storeName).add(data);
      });
      return result;
    },
    put(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName, data, key } = _option;
        return tx.objectStore(storeName).put(data, key);
      });
      return result;
    },
    delete(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName, key } = _option;
        return tx.objectStore(storeName).delete(key as string);
      });
      return result;
    },
    search(option) {
      fns.push((res) => {
        let _option = option;
        if (typeof _option === "function") {
          _option = (option as transactionOptionFn)(res);
        }
        const { storeName, index, key } = _option;
        const idbIndex = tx.objectStore(storeName).index(index as string);

        return idbIndex.openCursor(IDBKeyRange.only(key));
      });
      return result;
    },
  };
  return result;
}

export { db, createDB, deleteDB, createStore, transaction };
