
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers

print("1. Preparando datos (Sliding Windows)...")
# SIMULACIÓN: 5000 lecturas de 2 sensores (ej. presión y temperatura)
# Más adelante reemplazaremos esto con tu lectura de base de datos
datos_simulados = np.random.rand(5000, 2) 
etiquetas_simuladas = np.random.randint(0, 2, 5000) # 0: Normal, 1: Anomalía

def crear_ventanas(datos, etiquetas, tamano_ventana):
    X, y = [], []
    for i in range(len(datos) - tamano_ventana):
        X.append(datos[i:(i + tamano_ventana)])
        y.append(etiquetas[i + tamano_ventana - 1])
    return np.array(X), np.array(y)

X_train, y_train = crear_ventanas(datos_simulados, etiquetas_simuladas, 60)
print(f"Forma del tensor de entrada (muestras, pasos, sensores): {X_train.shape}")

print("\n2. Construyendo el modelo optimizado para TPU...")
model = tf.keras.Sequential([
    layers.Input(shape=(60, 2)),
    layers.Conv1D(16, kernel_size=3, activation='relu', padding='same'),
    
    # Convoluciones separables (ligeras y compatibles con Google Coral)
    layers.SeparableConv1D(32, kernel_size=3, activation='relu', padding='same'),
    layers.MaxPooling1D(pool_size=2),
    
    layers.SeparableConv1D(64, kernel_size=3, activation='relu', padding='same'),
    layers.MaxPooling1D(pool_size=2),
    
    layers.GlobalAveragePooling1D(),
    layers.Dense(2, activation='softmax') # 2 clases de salida
])

model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

print("\n3. Entrenando el modelo...")
model.fit(X_train, y_train, epochs=5, batch_size=32)

print("\n4. Guardando modelo base...")
model.save("modelo_flow_base.keras")
print("¡Éxito! Modelo guardado como modelo_flow_base.keras")