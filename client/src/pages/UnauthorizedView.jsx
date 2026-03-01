import React from "react";

const UnauthorizedView = () => {

  return (

    <div style={{

      backgroundColor: "black",

      color: "red",

      height: "100vh",

      display: "flex",

      justifyContent: "center",

      alignItems: "center",

      flexDirection: "column",

      border: "3px solid red",

      boxShadow: "0 0 20px red"

    }}>

      <h1>🚨 Unauthorized Area Detected</h1>

      <p>

        An unauthorized person has entered the restricted area.

      </p>

      <p>

        Please take immediate action.

      </p>

    </div>

  );

};

export default UnauthorizedView;