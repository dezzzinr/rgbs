import "./env.mjs";
import { input, password, confirm } from "@inquirer/prompts";
import {
  tx,
  pool,
  one,
  insert,
  hex,
  hashPassword,
  text,
} from "../server/core.mjs";
import { checkSchema } from "../server/schema.mjs";
try {
  await tx(checkSchema);
  const email = text(
    (await input({ message: "Admin email:" })).trim().toLowerCase(),
    254,
    5,
  );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Enter a valid email address");
  const name = text((await input({ message: "Admin name:" })).trim(), 80, 2);
  const secret = text(
    await password({ message: "Password (12–128 characters):", mask: "*" }),
    128,
    12,
  );
  if (secret !== (await password({ message: "Confirm password:", mask: "*" })))
    throw Error("Passwords do not match");
  if (
    !(await confirm({
      message:
        "Create a new administrator? Existing accounts will not be changed.",
      default: false,
    }))
  )
    throw Error("Cancelled");
  const digest = await hashPassword(secret);
  await tx(async (q) => {
    await checkSchema(q);
    if (await one(q, "SELECT id FROM users WHERE email=$1", [email]))
      throw Error("Email already exists; account was not changed.");
    await insert(q, "users", {
      id: hex(12),
      email,
      name,
      password: digest,
      role: "admin",
    });
  });
  console.log("Administrator created.");
} catch (e) {
  console.error(
    e.code
      ? "Database operation failed (" + e.code + "). No account was changed."
      : e.message,
  );
  process.exitCode = 1;
} finally {
  if (globalThis.__relayPool) await pool().end();
}
