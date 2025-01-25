import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./start.css";
import toast, { Toaster } from "react-hot-toast";

export const Start = () => {
  const navigate = useNavigate();

  const [playerType, setPlayerType] = useState("");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (playerType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [playerType]);

  const handleSelectPlayerType = (type: string) => {
    setPlayerType(type);
  };

  const handleStart = () => {
    if (!name) {
      toast.error("Please Enter your name", {
        icon: "❌ ",
        style: {
          borderRadius: "10px",
          background: "#030303",
          color: "#fff",
        },
      });
      return;
    }else if(!playerType){
        toast.error("Please select the player type", {
            icon: "❌ ",
            style: {
              borderRadius: "10px",
              background: "#030303",
              color: "#fff",
            },
          });
          return
    }
    navigate("/game", { state: { playerType, name } });
  };

  return (
    <div className="flex flex-col mx-auto min-h-screen justify-center justify-items-center items-center bg-zinc-900">
        <div className="flex justify-center gap-24  w-full pb-10" > 
            <h2 className="text-5xl mb-10 text-blue-600 font-extrabold" > TIC </h2>
            <h2 className="text-5xl mb-10 text-gray-100 font-extrabold" > TAC </h2>
            <h2 className="text-5xl mb-10 text-red-600 font-extrabold" > TOE </h2>
        </div>
      <Toaster />

      <div className="flex gap-4">

        <div
          className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer ${
            playerType === "X"
              ? "border-blue-600 bg-blue-100 text-blue-600"
              : "border-gray-500 text-blue-600"
          }`}
          onClick={() => handleSelectPlayerType("X")}
        >
          X
        </div>

        <div
          className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer ${
            playerType === "O"
              ? "border-red-600 bg-red-100 text-red-600"
              : "border-gray-500 text-red-600"
          }`}
          onClick={() => handleSelectPlayerType("O")}
        >
          O
        </div>
      </div>
      <>
        <input
          className="box-content h-12 w-54 p-4 border-4 border-gray-500 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-4xl font-extrabold text-gray-900 focus:outline-none"
          placeholder="Enter your name"
          style={{ textTransform: "uppercase" }}
          ref={inputRef}
          onChange={(e) => setName(e.target.value)}
        />
        <a
          className="text-gray-500 cursor-pointer"
          target="_blank"
          onClick={handleStart}
        >
          <span> </span>
          <span> </span>
          <span> </span>
          <span> </span>
          Start Game
        </a>
      </>
    </div>
  );
};
