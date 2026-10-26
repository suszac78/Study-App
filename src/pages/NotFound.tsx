import { Link } from 'react-router-dom'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="page">
      <div className="card empty">
        <h3>Page not found</h3>
        <Link to="/"><Button variant="primary">Go home</Button></Link>
      </div>
    </div>
  )
}
