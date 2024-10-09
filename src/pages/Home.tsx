import React, { useState } from "react";
import { Board } from "../components/Board";

export const Home : React.FC = () => {
    const [box, setBox] = useState(Array(9).fill(0))

    const handleClickBox = (val:any) => {
        console.log(val);
        
    }

    return (
        <>
        <div className="min-h-screen flex items-center" >
            <div className=" flex mx-auto  max-w-7xl justify-center" >
                <Board box={box} click={handleClickBox} />
            </div>
        </div>
        </>
    )
}