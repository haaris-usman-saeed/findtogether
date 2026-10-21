"use client";
import { useEffect, useState } from 'react';
import { App } from '../../src/App';
export default function Page(){ const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return ready?<App/>:<p className="p-8">Opening FindTogether…</p>; }
