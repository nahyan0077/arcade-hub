import React, { MouseEventHandler } from "react";

interface BoardProps {
    box: Array <any>
    click : (key: number)  => void
}

export const Board: React.FC <BoardProps> = ({box, click}) => {
    return (
        <>
            <div className="grid grid-cols-3 gap-4 justify-items-center" >
                {
                    box.map((_, index) => {
                        return (
                            <div key={index} className="h-40 w-40 bg-gray-600 hover:bg-gray-500" onClick={()=>click} > </div>
                        )
                    })
                }
            </div>
        </>
    )
}