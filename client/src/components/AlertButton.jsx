import React, { useState } from "react";
import "./AlertButton.css";

const AlertButton = () => {

  const [open, setOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    employeeId: ""
  });


  const toggleMenu = () => {
    setOpen(!open);
    setShowRegister(false);
  };


  const handleChange = (e) => {

    setFormData({

      ...formData,

      [e.target.name]: e.target.value

    });

  };


  const registerUser = async (e) => {

    e.preventDefault();

    const res = await fetch("http://localhost:5001/api/register", {

      method: "POST",

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify(formData)

    });

    const data = await res.json();

    alert(data.message);

  };


  const sendAlert = async () => {

    const res = await fetch("http://localhost:5001/api/send-alert", {

      method: "POST"

    });

    const data = await res.json();

    alert(data.message);

  };


  return (

    <>

      <button className="alert-floating-btn" onClick={toggleMenu}>
        🚨
      </button>


      {open && (

        <div className="alert-menu">

          <button

            className="alert-btn"

            onClick={sendAlert}

          >
            Send Alert
          </button>


          <button

            className="alert-btn"

            onClick={() => setShowRegister(!showRegister)}

          >
            Register
          </button>


          {showRegister && (

            <form

              className="alert-form"

              onSubmit={registerUser}
            >

              <input
                name="name"
                placeholder="Name"
                onChange={handleChange}
                required
              />

              <input
                name="email"
                placeholder="Email"
                onChange={handleChange}
                required
              />

              <input
                name="password"
                placeholder="Password"
                type="password"
                onChange={handleChange}
                required
              />

              <input
                name="employeeId"
                placeholder="Employee ID"
                onChange={handleChange}
                required
              />

              <button type="submit" className="alert-submit">
                Register User
              </button>

            </form>

          )}

        </div>

      )}

    </>

  );

};

export default AlertButton;