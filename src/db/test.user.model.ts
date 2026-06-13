import { pool } from '../config/db';
import { createUser, findById, findByEmail } from '../models/user.model';

const testUser = async (): Promise<void> => {
  const created = await createUser({
    username: 'test1',
    email: 'test@email.com',
    passwordHash: 'fakehash',
  });
  console.log('created: ', created); // check if it has id and no password_hash

  const found = await findByEmail('test@email.com');
  console.log('found: ', found);

  const byId = await findById(created.id);
  console.log('byId: ', byId);

  const ghost = await findByEmail('nobody@gmail.com');
  console.log('ghost ', ghost);

  await createUser({ username: 'test1', email: 'other@me.com', passwordHash: 'x' }).catch((e) =>
    console.log('duplicate error code: ', e.code)
  );

  await pool.end();
};

testUser();
