export default {
  files: "tests/web-test-runner/*.test.html",
  coverage: true,
  nodeResolve: true,
  plugins: [
    {
      name: "include-polyfill",
      transform(context) {
        if (context.response.is("html")) {
          return context.body.replace(
            /<\/body>/,
            `
  <script src="./ariaNotify-polyfill.js"></script>
  <script type="module">
    import { runTests } from "@web/test-runner-mocha";
    import { tests } from "./ariaNotify-polyfill.test.js";
    runTests(tests);
  </script>
</body>
`
          );
        }
      },
    },
  ],
};