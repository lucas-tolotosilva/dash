import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import PedidoDetalhe from "./pages/PedidoDetalhe";
import ResumoVendas from "./pages/Resumovendas";
// Importe aqui suas futuras telas de listagem:
// import PedidosLista from "./pages/PedidosLista"; 
// import OPsLista from "./pages/OPsLista";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ResumoVendas />} />
        {/* Rotas para a OS #006 */}
        {/* <Route path="/pedidos" element={<div>Tela de Listagem de Pedidos</div>} />
        <Route path="/ops" element={<div>Tela de Listagem de OPs</div>} />
        <Route path="/pedidos/:id" element={<PedidoDetalhe />} /> */}
      </Routes>
    </BrowserRouter>
  );
}