import React from "react";

interface BoardProps {
    box: Array <any>
}

export const Board: React.FC <BoardProps> = ({box}) => {
    return (
        <>
            <div className="grid grid-cols-3 gap-4 justify-items-center" >
                {
                    box.map((_, index) => {
                        return (
                            <div key={index} className="h-40 w-40 bg-gray-600 hover:bg-gray-500" > </div>
                        )
                    })
                }
            </div>
        </>
    )
}