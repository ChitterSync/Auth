"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-gray-500 font-[Jost,sans-serif] p-4">
      <div className="main w-full max-w-md bg-white/10 p-8 rounded-xl shadow-lg backdrop-blur text-white">
        <h1 className="text-center text-3xl font-bold mb-6">Welcome</h1>
        <p className="text-center text-lg">
          This is the 
          Authorization Portal For ChitterSync Accounts. Please{" "}
          <a href="/signin" className="underline hover:text-white">
            sign in
          </a>{" "}
          or{" "}
          <a href="/register" className="underline hover:text-white">
            register
          </a>
          .
        </p>
      </div>
    </div>
  );
}
