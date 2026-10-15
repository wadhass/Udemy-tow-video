import { Skeleton } from "@/components/ui/skeleton";
import { initialSignInFormData, initialSignUpFormData } from "@/config";
import { checkAuthService, loginService, registerService } from "@/services";
import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [signInFormData, setSignInFormData] = useState(initialSignInFormData);
  const [signUpFormData, setSignUpFormData] = useState(initialSignUpFormData);
  const [registerError, setRegisterError] = useState("");
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [auth, setAuth] = useState({
    authenticate: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  async function handleRegisterUser(event) {
    event.preventDefault();
    setRegisterError("");
    setEmailAlreadyRegistered(false);

    try {
      const data = await registerService(signUpFormData);

      if (data.success) {
        setSignUpFormData(initialSignUpFormData);
      }
    } catch (error) {
      const isExistingEmail =
        error?.response?.data?.code === "EMAIL_ALREADY_EXISTS";
      setRegisterError(
        error?.response?.data?.message || "Registration failed. Please try again."
      );
      setEmailAlreadyRegistered(isExistingEmail);
    }
  }

  async function handleLoginUser(event) {
    event.preventDefault();
    setLoginError("");

    try {
      const data = await loginService(signInFormData);

      if (data.success) {
        sessionStorage.setItem(
          "accessToken",
          JSON.stringify(data.data.accessToken)
        );
        setAuth({
          authenticate: true,
          user: data.data.user,
        });
      } else {
        setAuth({
          authenticate: false,
          user: null,
        });
        setLoginError("Unable to sign in. Please check your email and password.");
      }
    } catch (error) {
      setLoginError(
        error?.response?.data?.message || "Login failed. Please try again."
      );
      setAuth({
        authenticate: false,
        user: null,
      });
    }
  }

  //check auth user

  async function checkAuthUser() {
    try {
      const data = await checkAuthService();
      if (data.success) {
        setAuth({
          authenticate: true,
          user: data.data.user,
        });
        setLoading(false);
      } else {
        setAuth({
          authenticate: false,
          user: null,
        });
        setLoading(false);
      }
    } catch (error) {
      console.log(error);
      if (!error?.response?.data?.success) {
        setAuth({
          authenticate: false,
          user: null,
        });
        setLoading(false);
      }
    }
  }

  function resetCredentials() {
    setAuth({
      authenticate: false,
      user: null,
    });
  }

  useEffect(() => {
    checkAuthUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        signInFormData,
        setSignInFormData,
        signUpFormData,
        setSignUpFormData,
        registerError,
        emailAlreadyRegistered,
        loginError,
        setLoginError,
        handleRegisterUser,
        handleLoginUser,
        auth,
        resetCredentials,
      }}
    >
      {loading ? <Skeleton /> : children}
    </AuthContext.Provider>
  );
}
