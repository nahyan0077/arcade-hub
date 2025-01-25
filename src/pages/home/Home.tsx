import React, { useState } from "react";
import { Board } from "../../components/Board";
import { useLocation } from "react-router-dom";

export const Home : React.FC = () => {
    const location = useLocation()
    const [box, setBox] = useState(Array(9).fill(0))
    const [currentPlayer, setCurrentPlayer] = useState(location.state.playerType)

    console.log(location.state);
    

    const handleClickBox = (index:number) => {
        console.log("Box clicked:", index);
        if(box[index] != 0) return

        const newBox = [...box]
        newBox[index] = currentPlayer
        setBox(newBox)

        setCurrentPlayer(currentPlayer == "X" ? "O" : "X")
    }

    return (
        <>
        <div className="min-h-screen flex flex-col justify-center items-center justify-items-center bg-zinc-900" >
            <div className="flex justify-center gap-24  w-full pb-5" > 
                <h2 className="text-5xl mb-10 text-blue-600 font-extrabold" > TIC </h2>
                <h2 className="text-5xl mb-10 text-gray-100 font-extrabold" > TAC </h2>
                <h2 className="text-5xl mb-10 text-red-600 font-extrabold" > TOE </h2>
            </div>            
            <div className=" flex mx-auto  max-w-7xl justify-center" >
                <Board box={box} click={handleClickBox} />
            </div>
        </div>
        </>
    )
}