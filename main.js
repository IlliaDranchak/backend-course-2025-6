import { Command } from "commander";  

const program = new Command();

program
  .name("backend-course-2025-3")
  .description("Програма для демонстрації роботи з аргументами командного рядка")
  .version("1.0.0");

program
  .option("-n, --name <type>", "вкажіть ваше імʼя")
  .option("-a, --age <number>", "вкажіть ваш вік");

program.parse(process.argv);

const options = program.opts();
console.log(`Введені параметри:`, options);
