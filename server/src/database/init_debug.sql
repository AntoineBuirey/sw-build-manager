
BEGIN TRANSACTION;

INSERT INTO users (
    username,
    password
) VALUES (
    'admin',
    'd033e22ae348aeb5660fc2140aec35850c4da997'  -- This is the SHA1 hash of 'admin'
);

COMMIT;