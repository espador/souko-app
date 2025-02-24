// .eslintrc.js
module.exports = {
    rules: {
      "no-restricted-globals": [
        "error",
        {
          "name": "location",
          "message": "Use location from React Router `useLocation` hook instead of the global one."
        }
      ]
    }
  };