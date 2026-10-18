import React from "react";
import type { Board as BoardData } from "../engine";

interface BoardProps {
    box: BoardData
    click : (key: number)  => void
}

export const Board: React.FC <BoardProps> = ({box, click}) => {
    return (
        <>
            <div className="grid grid-cols-3 gap-4 justify-items-center" >
                {
                    box.map((value, index) => {
                        return (
                            <div key={index} className="flex h-36 w-36 bg-gray-600 hover:bg-gray-500 items-center justify-center" onClick={()=>click(index)} >
                               { value !== 0 &&  <span className={`text-8xl font-bold text-white select-none ${value === "X" ? 'text-blue-600' : 'text-red-600'}`}>{value }</span> }   
                            </div>
                        )
                    })
                }
            </div>
        </>
    )
}